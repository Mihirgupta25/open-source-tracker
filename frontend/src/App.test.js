import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Open Source Growth Tracker title', () => {
  render(<App />);
  const titleElement = screen.getByText(/Open Source Growth Tracker/i);
  expect(titleElement).toBeInTheDocument();
});
