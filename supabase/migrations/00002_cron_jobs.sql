-- Cron Jobs Migration
-- Replaces convex/crons.ts
-- Requires pg_cron extension (enabled by default in Supabase)

-- ============================================
-- CLEANUP FUNCTIONS
-- ============================================

-- Function to cleanup expired live match rooms
-- Runs every 10 minutes (equivalent to Convex cron)
CREATE OR REPLACE FUNCTION cleanup_expired_live_rooms()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  room_record RECORD;
  active_count INTEGER;
BEGIN
  FOR room_record IN 
    SELECT id, expires_at FROM live_match_rooms 
    WHERE expires_at IS NOT NULL 
    AND expires_at <= extract(epoch from now()) * 1000
    LIMIT 20
  LOOP
    -- Check if room has active participants
    SELECT COUNT(*) INTO active_count
    FROM live_match_participants
    WHERE room_id = room_record.id
    AND removed_at IS NULL;

    IF active_count > 0 THEN
      -- Extend expiry if participants exist
      UPDATE live_match_rooms 
      SET expires_at = extract(epoch from now()) * 1000 + 600000 -- 10 minutes
      WHERE id = room_record.id;
    ELSE
      -- Delete related records (cascade should handle most, but explicit for safety)
      DELETE FROM live_match_reactions WHERE room_id = room_record.id;
      DELETE FROM live_match_logs WHERE room_id = room_record.id;
      DELETE FROM live_match_answers WHERE room_id = room_record.id;
      DELETE FROM live_match_rounds WHERE room_id = room_record.id;
      DELETE FROM live_match_participants WHERE room_id = room_record.id;
      DELETE FROM live_match_rooms WHERE id = room_record.id;
      deleted_count := deleted_count + 1;
    END IF;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup stale participants
-- Runs every 2 minutes (equivalent to Convex cron)
CREATE OR REPLACE FUNCTION cleanup_stale_live_participants()
RETURNS TABLE(rooms_scanned INTEGER, participants_pruned INTEGER, rooms_reset INTEGER) AS $$
DECLARE
  room_record RECORD;
  participant_record RECORD;
  v_rooms_scanned INTEGER := 0;
  v_participants_pruned INTEGER := 0;
  v_rooms_reset INTEGER := 0;
  active_before INTEGER;
  active_after INTEGER;
  now_ts TIMESTAMPTZ := NOW();
  offline_grace_ms BIGINT := 120000; -- 2 minutes
  timeout_ms BIGINT := 30000; -- 30 seconds
BEGIN
  -- Scan up to 20 rooms
  FOR room_record IN 
    SELECT * FROM live_match_rooms
    LIMIT 20
  LOOP
    v_rooms_scanned := v_rooms_scanned + 1;
    
    -- Count active before
    SELECT COUNT(*) INTO active_before
    FROM live_match_participants
    WHERE room_id = room_record.id
    AND removed_at IS NULL;

    -- Mark disconnected participants
    FOR participant_record IN
      SELECT * FROM live_match_participants
      WHERE room_id = room_record.id
      AND removed_at IS NULL
      AND EXTRACT(EPOCH FROM (now_ts - last_seen_at)) * 1000 > timeout_ms
    LOOP
      IF participant_record.disconnected_at IS NULL THEN
        -- First time disconnect
        UPDATE live_match_participants
        SET disconnected_at = now_ts, is_ready = false
        WHERE id = participant_record.id;
      ELSIF EXTRACT(EPOCH FROM (now_ts - participant_record.disconnected_at)) * 1000 > offline_grace_ms THEN
        -- Grace period expired, remove participant
        UPDATE live_match_participants
        SET removed_at = now_ts, disconnected_at = NULL, is_host = false, is_ready = false
        WHERE id = participant_record.id;
        v_participants_pruned := v_participants_pruned + 1;
      END IF;
    END LOOP;

    -- Reconnect participants who are now active
    UPDATE live_match_participants
    SET disconnected_at = NULL
    WHERE room_id = room_record.id
    AND removed_at IS NULL
    AND disconnected_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (now_ts - last_seen_at)) * 1000 <= timeout_ms;

    -- Count active after
    SELECT COUNT(*) INTO active_after
    FROM live_match_participants
    WHERE room_id = room_record.id
    AND removed_at IS NULL;

    -- Reset room to lobby if all participants left during game
    IF active_before > 0 AND active_after = 0 AND room_record.status != 'lobby' THEN
      UPDATE live_match_rooms
      SET 
        status = 'lobby',
        current_round = 0,
        server_now = EXTRACT(EPOCH FROM now_ts) * 1000,
        phase_ends_at = NULL,
        pause_state = NULL,
        pending_action = NULL,
        expires_at = EXTRACT(EPOCH FROM now_ts) * 1000 + 600000,
        version = COALESCE(version, 0) + 1
      WHERE id = room_record.id;
      v_rooms_reset := v_rooms_reset + 1;
    END IF;

    -- Transfer host if needed
    IF active_after > 0 THEN
      DECLARE
        current_host_active BOOLEAN;
        new_host_record RECORD;
      BEGIN
        -- Check if current host is still active
        SELECT EXISTS(
          SELECT 1 FROM live_match_participants
          WHERE room_id = room_record.id
          AND removed_at IS NULL
          AND (
            (room_record.host_id IS NOT NULL AND user_id = room_record.host_id)
            OR identity_id = room_record.host_identity
          )
        ) INTO current_host_active;

        IF NOT current_host_active THEN
          -- Find new host (prefer authenticated users)
          SELECT * INTO new_host_record
          FROM live_match_participants
          WHERE room_id = room_record.id
          AND removed_at IS NULL
          ORDER BY (user_id IS NOT NULL) DESC, joined_at ASC
          LIMIT 1;

          IF new_host_record.id IS NOT NULL THEN
            -- Update room host
            UPDATE live_match_rooms
            SET 
              host_id = new_host_record.user_id,
              host_identity = new_host_record.identity_id,
              version = COALESCE(version, 0) + 1
            WHERE id = room_record.id;

            -- Update participant host status
            UPDATE live_match_participants
            SET is_host = false
            WHERE room_id = room_record.id AND is_host = true;
            
            UPDATE live_match_participants
            SET is_host = true
            WHERE id = new_host_record.id;

            -- Log transfer
            INSERT INTO live_match_logs (room_id, type, payload)
            VALUES (
              room_record.id,
              'host_transferred',
              jsonb_build_object(
                'previousHost', room_record.host_id,
                'previousHostIdentity', room_record.host_identity,
                'newHost', new_host_record.user_id,
                'newHostIdentity', new_host_record.identity_id,
                'transferredAt', EXTRACT(EPOCH FROM now_ts) * 1000
              )
            );
          END IF;
        END IF;
      END;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_rooms_scanned, v_participants_pruned, v_rooms_reset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SCHEDULE CRON JOBS
-- ============================================

-- Note: These jobs are created using Supabase's pg_cron
-- Run these commands in Supabase Dashboard SQL Editor after deployment

-- Cleanup expired rooms every 10 minutes
SELECT cron.schedule(
  'cleanup-expired-live-rooms',
  '*/10 * * * *',
  $$ SELECT cleanup_expired_live_rooms(); $$
);

-- Cleanup stale participants every 2 minutes
SELECT cron.schedule(
  'cleanup-stale-live-participants',
  '*/2 * * * *',
  $$ SELECT cleanup_stale_live_participants(); $$
);

-- ============================================
-- UTILITY: View scheduled jobs
-- ============================================

-- To view scheduled jobs:
-- SELECT * FROM cron.job;

-- To view job run history:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- To unschedule a job:
-- SELECT cron.unschedule('cleanup-expired-live-rooms');
-- SELECT cron.unschedule('cleanup-stale-live-participants');
