import React from 'react';
import { Link } from 'react-router-dom';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Application error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-800">Something went wrong</h1>
          <p className="mt-2 text-gray-500 max-w-md">An unexpected error occurred. Please refresh the page or return home.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2 rounded-lg bg-primary text-white hover:bg-primary-dull"
            >
              Refresh
            </button>
            <Link to="/" className="px-5 py-2 rounded-lg border border-borderColor text-gray-700 hover:bg-gray-50">
              Go Home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
