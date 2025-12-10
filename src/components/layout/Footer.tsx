import { Box } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Box className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-medium text-sm text-text-secondary">
              Parametric 3D Generator
            </span>
          </div>
          
          <nav className="flex items-center gap-6 text-sm text-text-muted">
            <Link to="/about" className="hover:text-foreground transition-colors">
              About
            </Link>
            <Link to="/gallery" className="hover:text-foreground transition-colors">
              Gallery
            </Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">
              Contact
            </Link>
          </nav>
          
          <p className="text-sm text-text-muted">
            © 2024 All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
