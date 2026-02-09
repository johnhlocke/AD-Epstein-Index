interface SectionContainerProps {
  children: React.ReactNode;
  width?: "text" | "viz" | "full";
  className?: string;
  id?: string;
}

const widthClasses = {
  text: "max-w-[720px]",
  viz: "max-w-[1200px]",
  full: "max-w-[1400px]",
} as const;

export function SectionContainer({
  children,
  width = "viz",
  className = "",
  id,
}: SectionContainerProps) {
  return (
    <section id={id} className={`mx-auto w-full px-6 ${widthClasses[width]} ${className}`}>
      {children}
    </section>
  );
}
