import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

type Props = {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed?: boolean;
};

export function SidebarItem({ to, icon, label, collapsed }: Props) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => `pm-sidebar-item${isActive ? " pm-sidebar-item--active" : ""}`}
      title={collapsed ? label : undefined}
    >
      <span className="pm-sidebar-item-icon" aria-hidden>
        {icon}
      </span>
      <span className="pm-sidebar-item-label">{label}</span>
    </NavLink>
  );
}
