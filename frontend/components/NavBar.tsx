"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import GlobalSearch from "./GlobalSearch";

const NAV_LINKS = [
  { href: "/",          label: "Home"      },
  { href: "/jobs",      label: "Jobs"      },
  { href: "/products",  label: "Products"  },
  { href: "/loans",     label: "Loans"     },
  { href: "/new",       label: "+ New Job" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      gap: 0,
      background: "#ffffff",
      borderBottom: "1px solid #e5e7eb",
      padding: "0 24px",
      height: 52,
      fontFamily: "var(--font-geist-sans), sans-serif",
      position: "sticky",
      top: 0,
      zIndex: 200,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: "none", marginRight: 32 }}>
        <span style={{
          fontSize: 13,
          fontWeight: 700,
          color: "#1d4ed8",
          border: "2px solid #1d4ed8",
          borderRadius: 6,
          padding: "4px 10px",
          letterSpacing: 0.5,
        }}>
          FLOORMANAGER
        </span>
      </Link>

      {/* Global search */}
      <div style={{ marginLeft: "auto", marginRight: 16 }}>
        <GlobalSearch />
      </div>

      {/* Nav links */}
      {NAV_LINKS.map(({ href, label }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            style={{
              textDecoration: "none",
              padding: "0 16px",
              height: "100%",
              display: "flex",
              alignItems: "center",
              fontSize: 13,
              fontWeight: active ? 600 : 400,
              color: active ? "#1d4ed8" : "#6b7280",
              borderBottom: active ? "2px solid #1d4ed8" : "2px solid transparent",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
