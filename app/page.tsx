import Banner from '../components/Banner';
import Header from '../components/Header';
import HomeScreen from '../components/HomeScreen';
import Row from '../components/Row';
import { Movie } from '../typings';
import { Provider } from 'react-redux';
import { store } from '../store';
import requests from '../pages/api/requests';
import { useSelector, useDispatch } from 'react-redux';
import { signin, signout } from '../slices/userSlice';
import type { RootState } from '../store';
import { useAuth, AuthProvider } from '../contexts/AuthContext';
import SignInScreen from './SignInScreen';

export default async function Home() {
  const [
    netflixOriginals,
    trendingNow,
    topRated,
    actionMovies,
    comedyMovies,
    horrorMovies,
    romanceMovies,
    documentaries,
  ] = await Promise.all([
    fetch(requests.fetchNetflixOriginals).then((res) => res.json()),
    fetch(requests.fetchTrending).then((res) => res.json()),
    fetch(requests.fetchTopRated).then((res) => res.json()),
    fetch(requests.fetchActionMovies).then((res) => res.json()),
    fetch(requests.fetchComedyMovies).then((res) => res.json()),
    fetch(requests.fetchHorrorMovies).then((res) => res.json()),
    fetch(requests.fetchRomanceMovies).then((res) => res.json()),
    fetch(requests.fetchDocumentaries).then((res) => res.json()),
  ]);

  return (
    <div>
      <Header />

      <main>
        <RequireAuth>

        <Banner netflixOriginals={netflixOriginals.results} />

        <section className='absolute top-2/3 sm:top-[60%] space-y-10 pb-10 px-5 sm:px-10'>
          <Row title='Trending Now' movies={trendingNow.results} />
          <Row title='Top Rated' movies={topRated.results} />
          <Row title='Action Movies' movies={actionMovies.results} />
          <Row title='Comedy Movies' movies={comedyMovies.results} />
          <Row title='Horror Movies' movies={horrorMovies.results} />
          <Row title='Romance Movies' movies={romanceMovies.results} />
          <Row title='Documentaries' movies={documentaries.results} />
        </section>
        </RequireAuth>
      </main>
    </div>
  );
}
