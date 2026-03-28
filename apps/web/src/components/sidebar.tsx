"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useStytch, useStytchUser } from "@stytch/nextjs";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, FolderOpen, LayoutGrid, PanelLeftClose, PanelLeft } from "lucide-react";

export function Sidebar() {
  const router = useRouter();
  const stytchClient = useStytch();
  const { user } = useStytchUser();
  const [expanded, setExpanded] = useState(false);

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

  const pathname = usePathname();
  const userEmail = user?.emails?.[0]?.email || "";
  const userName = user?.name?.first_name || userEmail.split("@")[0] || "User";
  const initials = userName.slice(0, 2).toUpperCase();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen flex flex-col py-5 border-r border-white/[0.04] bg-black/20 backdrop-blur-xl transition-all duration-200 ease-out",
        expanded ? "w-80" : "w-16"
      )}
    >
      {/* Top: Logo + Toggle */}
      {expanded ? (
        <div className="flex items-center justify-between px-4 mb-6">
          <Link href="/projects" className="flex items-center gap-2 min-w-0">
            <span className="text-lg font-normal text-[#8B5CF6] flex-shrink-0">V</span>
            <span className="text-sm font-normal text-white/80 truncate">Viona</span>
          </Link>
          <button
            onClick={() => setExpanded(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-all flex-shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setExpanded(true)}
            className="group w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-white/[0.06]"
          >
            <span className="text-lg font-normal text-[#8B5CF6] group-hover:hidden">V</span>
            <PanelLeft className="w-4 h-4 text-white/50 hidden group-hover:block" />
          </button>
        </div>
      )}

      {/* Nav */}
      <nav className={cn("flex flex-col gap-1 flex-1", expanded ? "px-3" : "items-center")}>
        {[
          { href: "/projects", label: "Projects", icon: FolderOpen },
          { href: "/templates", label: "Templates", icon: LayoutGrid },
        ].map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-xl transition-all",
                expanded ? "h-10 px-3" : "w-10 h-10 justify-center",
                active
                  ? "text-white/90 bg-white/[0.08]"
                  : "text-white/40 hover:text-white/90 hover:bg-white/[0.06]"
              )}
            >
              <Icon className="w-[18px] h-[18px] flex-shrink-0" />
              {expanded && <span className="text-sm">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User menu */}
      <div className={cn("flex", expanded ? "px-3" : "justify-center")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-3 rounded-xl hover:bg-white/[0.06] transition-all",
                expanded ? "w-full px-3 py-2" : "w-9 h-9 justify-center rounded-full hover:ring-2 hover:ring-white/10"
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-white/[0.08] text-white/60 text-xs font-normal">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {expanded && (
                <div className="flex flex-col items-start leading-none min-w-0">
                  <span className="text-sm text-white/80 truncate max-w-[120px]">{userName}</span>
                </div>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-[rgba(28,28,35,0.95)] backdrop-blur-2xl border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)] rounded-xl"
            side="right"
            align="end"
            sideOffset={12}
          >
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
    </aside>
  );
}

/** Width constant so layout can stay in sync */
export const SIDEBAR_WIDTH_COLLAPSED = "4rem"; // 64px = w-16
export const SIDEBAR_WIDTH_EXPANDED = "13rem"; // 208px = w-52
