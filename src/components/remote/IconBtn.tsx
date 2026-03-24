import type React from "react";
import { Button } from "@/components/ui/button";

export function IconBtn({
  children,
  onClick,
  title,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <Button
      onClick={onClick}
      title={title}
      variant="ghost"
      className={`action-btn cursor-pointer border-none focus:outline-none ${className}`}
    >
      {children}
    </Button>
  );
}
