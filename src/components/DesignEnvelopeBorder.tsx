import React from "react";
import { CoupleDesign } from "../types";

interface DesignEnvelopeBorderProps {
  design: CoupleDesign;
  children: React.ReactNode;
  className?: string;
}

export default function DesignEnvelopeBorder({ design, children, className = "" }: DesignEnvelopeBorderProps) {
  const getBorderStyle = () => {
    switch (design.borderStyle) {
      case "Modern Rounded":
        return {
          borderRadius: "1.5rem",
          borderWidth: "3px",
          borderStyle: "solid",
          borderColor: design.borderColor,
          backgroundColor: design.canvasBg,
        };
      case "Double Classic":
        return {
          borderWidth: "6px",
          borderStyle: "double",
          borderColor: design.borderColor,
          backgroundColor: design.canvasBg,
          padding: "1.5rem",
        };
      case "Vintage Regal":
        return {
          borderWidth: "2px",
          borderStyle: "solid",
          borderColor: design.borderColor,
          backgroundColor: design.canvasBg,
          position: "relative" as const,
        };
      case "Top Accent Stripe":
        return {
          borderTopWidth: "10px",
          borderTopStyle: "solid" as const,
          borderTopColor: design.primaryColor,
          borderLeftWidth: "1px",
          borderRightWidth: "1px",
          borderBottomWidth: "1px",
          borderStyle: "solid",
          borderColor: design.borderColor,
          backgroundColor: design.canvasBg,
          borderRadius: "0 0 0.75rem 0.75rem",
        };
      default:
        return {
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: design.borderColor,
          backgroundColor: design.canvasBg,
        };
    }
  };

  if (design.borderStyle === "Vintage Regal") {
    return (
      <div
        className={`shadow-xl transition-all duration-300 p-6 md:p-8 ${className}`}
        style={getBorderStyle()}
      >
        {/* Ornate inner dotted line to model vintage editorial patterns */}
        <div
          className="absolute inset-2 border border-dashed pointer-events-none rounded-sm"
          style={{ borderColor: `${design.borderColor}aa` }}
        />
        <div className="relative z-10">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={`shadow-lg transition-all duration-300 ${className}`}
      style={getBorderStyle()}
    >
      {children}
    </div>
  );
}
