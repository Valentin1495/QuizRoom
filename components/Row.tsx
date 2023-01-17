'use client';

import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import React, { useRef } from 'react';
import { Movie } from '../typings';

interface Props {
  title: string;
  movies: Movie[];
}

const Row = ({ title, movies }: Props) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const handleClick = (direction: String) => {
    if (rowRef.current) {
      const { scrollLeft, clientWidth } = rowRef.current;

      let scrollTo;

      if (direction === 'left') {
        scrollTo = scrollLeft - clientWidth;
        rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
      } else if (direction === 'right') {
        scrollTo = scrollLeft + clientWidth;
        rowRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className='space-y-3'>
      <h2 className='text-white text-base md:text-2xl font-bold'>{title}</h2>
      <div className='flex relative items-center group'>
        <ChevronLeftIcon
          className='rowIcon'
          onClick={() => handleClick('left')}
        />
        <div ref={rowRef} className='overflow-x-scroll scrollbar-hide'>
          <div className='flex gap-x-2'>
            {movies.map((movie) => (
              <img
                key={movie.id}
                src={`https://image.tmdb.org/t/p/w500${
                  movie.backdrop_path || movie.poster_path
                }`}
                alt='Thumbnail'
                className='object-cover rounded-sm w-36 h-24 sm:w-48 sm:h-32 hover:opacity-80'
              />
            ))}
          </div>
        </div>
        <ChevronRightIcon
          className='rowIcon right-0'
          onClick={() => handleClick('right')}
        />
      </div>
    </div>
  );
};

export default Row;
