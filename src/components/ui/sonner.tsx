import React from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ theme = "light", ...props }: ToasterProps) => {
  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover, #ffffff)",
          "--normal-text": "var(--popover-foreground, #000000)",
          "--normal-border": "var(--border, #e2e8f0)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
