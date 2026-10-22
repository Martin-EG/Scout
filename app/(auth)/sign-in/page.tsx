import { Suspense } from "react";
import { SignInForm } from "@/components/auth/SignInForm";
import { authenticate } from "../actions";

export const metadata = { title: "Sign in · Scout" };

export default function SignInPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div>
        <h1 className="text-2xl font-semibold">Sign in to Scout</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Find people who need your app. Scout drafts, you post.
        </p>
      </div>
      <Suspense>
        <SignInForm action={authenticate} />
      </Suspense>
    </main>
  );
}
