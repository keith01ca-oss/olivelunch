import { redirect } from 'next/navigation';

export default function HomePage() {
  // We can eventually add a landing page here, but for now we redirect to the app.
  redirect('/dashboard');
}
