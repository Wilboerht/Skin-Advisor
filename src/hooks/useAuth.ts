
import { useUser } from '@/components/auth/UserProvider';

export function useAuth() {
    return useUser();
}

