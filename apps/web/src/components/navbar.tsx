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
import { LogOut, FolderOpen, Upload, User } from "lucide-react";

export function Navbar() {
  const router = useRouter();
  const stytchClient = useStytch();
  const { user } = useStytchUser();

  const handleLogout = async () => {
    try {
      await stytchClient.session.revoke();
      // Clear cookies
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
    <nav className="sticky top-0 z-50 border-b border-white/[0.06] bg-[rgba(8,8,12,0.6)] backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/projects" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-[#8B5CF6]">Viona</span>
          <span className="text-xs font-medium text-white/40 tracking-wide uppercase">Studio</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white/90 transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            My Projects
          </Link>
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full hover:bg-white/[0.06]">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-[#8B5CF6] text-white font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 bg-[rgba(28,28,35,0.9)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-xl" align="end" forceMount>
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium text-white/90">{userName}</p>
                {userEmail && (
                  <p className="w-[200px] truncate text-sm text-white/40">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem asChild className="text-white/70 hover:text-white hover:bg-white/[0.06] focus:bg-white/[0.06] focus:text-white rounded-lg">
              <Link href="/projects" className="cursor-pointer">
                <FolderOpen className="mr-2 h-4 w-4" />
                My Projects
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              className="cursor-pointer text-red-400 focus:text-red-400 hover:bg-white/[0.06] focus:bg-white/[0.06] rounded-lg"
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
