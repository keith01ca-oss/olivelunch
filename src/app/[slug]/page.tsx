import { redirect } from 'next/navigation';

export default function OrganizationEntryPoint({ params }: { params: { slug: string } }) {
  // Redirect to the route handler which can safely set cookies on the response object
  redirect(`/api/set-org?slug=${params.slug}`);
}

