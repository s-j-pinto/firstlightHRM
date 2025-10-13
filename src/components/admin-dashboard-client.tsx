"use client";

import dynamic from 'next/dynamic';

// Dynamically import AdminDashboard on the client with SSR turned off
const AdminDashboard = dynamic(() => import('@/components/admin-dashboard'), { 
  ssr: false,
  loading: () => <p>Loading Dashboard...</p> // Optional: add a loading component
});

export default function AdminDashboardClient() {
  return <AdminDashboard />;
}
