import Link from "next/link";

interface UserMenuProps {
  email: string | null;
  signOutAction: () => Promise<void>;
}

export function UserMenu({ email, signOutAction }: UserMenuProps) {
  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/projects" className="hover:underline">
        Projects
      </Link>
      {process.env.NODE_ENV !== "production" && (
        <Link href="/dev/llm" className="hover:underline">
          LLM test
        </Link>
      )}
      {email && <span className="hidden text-zinc-500 sm:inline">{email}</span>}
      <form action={signOutAction}>
        <button type="submit" className="text-zinc-600 hover:underline dark:text-zinc-400">
          Sign out
        </button>
      </form>
    </div>
  );
}
