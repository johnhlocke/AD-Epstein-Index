interface FitNameProps {
  name: string;
}

export function FitName({ name }: FitNameProps) {
  return (
    <h1
      style={{
        fontFamily: "futura-pt, sans-serif",
        color: "#1A1A1A",
        fontSize: "80px",
        fontWeight: 900,
        lineHeight: 0.95,
      }}
    >
      {name}
    </h1>
  );
}
