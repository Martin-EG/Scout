import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { UserMenu } from "@/components/auth/UserMenu";
import { getSessionUser } from "@/lib/db/auth";
import { HOME_PATH } from "@/lib/config";
import { signOut } from "./(auth)/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Scout",
  description: "Find where your users hang out and draft honest replies.",
};

async function HeaderUser() {
  const user = await getSessionUser();
  if (!user) return null;
  return <UserMenu email={user.email} signOutAction={signOut} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
            <Link href={HOME_PATH} className="font-semibold">
              Scout
            </Link>
            <Suspense>
              <HeaderUser />
            </Suspense>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
