import InitiumLogo from "./InitiumLogo";

const Footer = () => {
  return (
    <footer className="border-t border-border/40 py-12">
      <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <InitiumLogo size="sm" />
        <p className="text-xs text-muted-foreground">
          © 2026 Initium+. Evaluación conductual de talento.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
