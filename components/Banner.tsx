'use client';

import { InformationCircleIcon, PlayIcon } from '@heroicons/react/24/solid';
import { useEffect, useState } from 'react';
import { Movie } from '../typing';

interface Props {
  netflixOriginals: Movie[];
}

const Banner = ({ netflixOriginals }: Props) => {
  const [movie, setMovie] = useState<Movie | null>(null);

  useEffect(() => {
    setMovie(
      netflixOriginals[Math.floor(Math.random() * netflixOriginals.length)]
    );
  }, [netflixOriginals]);

  const truncate = (str: string, num: number) => {
    if (str?.length > num) {
      return str?.slice(0, num) + '...';
    } else {
      return str;
    }
  };

  return (
    <div>
      <div className='absolute w-full h-screen bg-gradient-to-t from-black' />
      <img
        src={`https://image.tmdb.org/t/p/original/${
          movie?.backdrop_path || movie?.poster_path
        }`}
        alt='Banner Image'
        className='w-full object-cover h-screen'
      />

      <div className='absolute top-1/3 sm:top-1/4 left-5 right-5 sm:left-10 max-w-lg md:max-w-2xl'>
        <h1 className='py-3 truncate italic text-white text-3xl md:text-5xl'>
          {movie?.title || movie?.name || movie?.original_name}
        </h1>
        <p className='text-white text-base md:text-xl'>
          {truncate(movie?.overview!, 200)}
        </p>
        <div className='flex justify-start gap-x-10 mt-3'>
          <button className='bannerBtn'>
            <PlayIcon className='bannerIcon' /> Play
          </button>
          <button className='bannerBtn'>
            <InformationCircleIcon className='bannerIcon' /> More Info
          </button>
        </div>
      </div>
    </div>
  );
};

export default Banner;
