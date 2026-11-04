import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="container page narrow">
      <h1>Page not found</h1>
      <p>
        That page doesn't exist. <Link to="/">Go to the home page</Link>.
      </p>
    </div>
  );
}
