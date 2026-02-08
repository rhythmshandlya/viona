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
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/upload" className="flex items-center space-x-2">
          <span className="text-xl font-bold text-primary">Cllipify</span>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          <Link
            href="/projects"
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderOpen className="h-4 w-4" />
            My Projects
          </Link>
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium">{userName}</p>
                {userEmail && (
                  <p className="w-[200px] truncate text-sm text-muted-foreground">
                    {userEmail}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/projects" className="cursor-pointer">
                <FolderOpen className="mr-2 h-4 w-4" />
                My Projects
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
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
