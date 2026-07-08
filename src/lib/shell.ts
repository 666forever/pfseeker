import { siteConfig } from "@/lib/config";

export interface NavItem {
  label: string;
  href: string;
}

export interface FooterGroup {
  title: string;
  links: NavItem[];
}

export const primaryNavItems = [
  { label: "Home", href: "/" },
  { label: "Profile Pictures", href: "/pfps" },
  { label: "Banners", href: "/banners" },
  { label: "Icons", href: "/icons" },
  { label: "Collections", href: "/collections" },
] satisfies NavItem[];

export const footerGroups = [
  {
    title: "Explore",
    links: primaryNavItems.filter((item) => item.href !== "/"),
  },
  {
    title: "Information",
    links: [
      { label: "About", href: "/about" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
] satisfies FooterGroup[];

export function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "/") {
    return "/";
  }

  return pathname.replace(/\/+$/, "") || "/";
}

export function isActivePath(currentPathname: string, href: string): boolean {
  const current = normalizePathname(currentPathname);
  const target = normalizePathname(href);

  if (target === "/") {
    return current === "/";
  }

  return current === target || current.startsWith(`${target}/`);
}

export function getActiveNavHref(
  currentPathname: string,
  items: NavItem[] = primaryNavItems,
): string | undefined {
  return [...items]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => isActivePath(currentPathname, item.href))?.href;
}

export function parseSearchQuery(searchParams: URLSearchParams): string {
  return (searchParams.get("q") ?? "").trim().slice(0, 120);
}

export function canonicalUrl(pathname: string): string {
  return new URL(normalizePathname(pathname), siteConfig.siteUrl).toString();
}

export function titleTemplate(title: string): string {
  return title === siteConfig.name ? title : `${title} | ${siteConfig.name}`;
}
