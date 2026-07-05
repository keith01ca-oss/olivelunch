'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addChild } from '@/app/(parent)/settings/actions';
import { parseAndFormatLunchTime } from '@/lib/utils';

interface School {
  id: string;
  name: string;
  is_active: boolean | null;
}

interface NewChildFormProps {
  schools: School[];
  parentId: string;
  orgId: string;
  initialChildrenCount: number;
}

export default function NewChildForm({ schools, parentId, orgId, initialChildrenCount }: NewChildFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (initialChildrenCount >= 4) {
      toast.error('each account max 4 child');
      return;
    }

    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const lunchTimeInput = formData.get('lunchTime') as string;
    const formattedLunchTime = parseAndFormatLunchTime(lunchTimeInput);

    if (!formattedLunchTime) {
      toast.error('Invalid lunch time. Please enter a valid 12-hour format time (e.g. 11:30 AM or 12:30 PM).');
      setIsSaving(false);
      return;
    }

    formData.set('lunchTime', formattedLunchTime);

    try {
      const res = await addChild(formData);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success('Child added successfully!');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to add child.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Add a Child</h1>
        <p className="text-muted-foreground mt-1">Register your child to start ordering their lunch.</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          <input type="hidden" name="parentId" value={parentId} />
          <input type="hidden" name="orgId" value={orgId} />
          
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium leading-none">
              Child's Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="e.g. Olivia Leung"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="schoolId" className="text-sm font-medium leading-none">
              School
            </label>
            <select
              id="schoolId"
              name="schoolId"
              required
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              defaultValue=""
            >
              <option value="" disabled>Select a school...</option>
              {schools.filter(s => s.is_active !== false).map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="division" className="text-sm font-medium leading-none">
              Division / Class
            </label>
            <input
              type="text"
              id="division"
              name="division"
              required
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="e.g. 3N"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="deliveryLocation" className="text-sm font-medium leading-none">
              Delivery Location
            </label>
            <p className="text-[0.8rem] text-muted-foreground mb-2">
              Where should your lunch be delivered at school normally? Please check with the school office they will let you know where to send your child's lunch.
            </p>
            <input
              type="text"
              id="deliveryLocation"
              name="deliveryLocation"
              required
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="e.g. Classroom / Office / Box by entrance / Designated area - please specify"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lunchTime" className="text-sm font-medium leading-none">
              Lunch Time
            </label>
            <input
              type="text"
              id="lunchTime"
              name="lunchTime"
              required
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              placeholder="e.g. 11:30 AM"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors mt-8 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Child'}
          </button>
        </form>
      </div>
    </div>
  );
}
