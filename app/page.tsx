import LoginGate from '@/components/LoginGate';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <LoginGate>
      <Dashboard />
    </LoginGate>
  );
}
