"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStytch, useStytchUser } from "@stytch/nextjs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { VionaLogo } from "@/components/viona-logo";
import { LogOut } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const stytchClient = useStytch();
  const { user } = useStytchUser();

  const handleLogout = async () => {
    try {
      await stytchClient.session.revoke();
      document.cookie = "stytch_session=; path=/; max-age=0";
      document.cookie = "stytch_session_jwt=; path=/; max-age=0";
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const userEmail = user?.emails?.[0]?.email || "";
  const userName = user?.name?.first_name || userEmail.split("@")[0] || "User";
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <nav className="sticky top-0 z-50 border-b border-white/[0.04] bg-transparent backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/projects" className="flex items-center">
          <VionaLogo size="md" />
        </Link>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full hover:bg-white/[0.06]">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-white/[0.08] text-white/70 text-xs font-normal">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[rgba(28,28,35,0.95)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-xl" align="end" forceMount>
            <div className="flex items-center gap-2 p-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#8B5CF6] text-white text-xs font-normal">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-none">
                <p className="font-normal text-sm text-white/90">{userName}</p>
                {userEmail && (
                  <p className="text-xs text-white/40 truncate max-w-[180px] mt-0.5">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              className="cursor-pointer text-white/50 hover:text-white hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-white rounded-lg mx-1 my-0.5"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
