import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Box, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', label: 'Generator' },
  { path: '/custom', label: 'Custom' },
  { path: '/about', label: 'About' },
  { path: '/gallery', label: 'Gallery' },
  { path: '/contact', label: 'Contact' },
];

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b-2 border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo - Tom Sachs industrial badge style */}
          <Link to="/" className="flex items-center gap-3 group">
            <div 
              className="w-10 h-10 bg-primary border-2 border-foreground flex items-center justify-center group-hover:translate-x-[-2px] group-hover:translate-y-[-2px] transition-transform"
              style={{ boxShadow: '3px 3px 0px hsl(20 10% 5%)' }}
            >
              <Box className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg hidden sm:block text-card-foreground uppercase tracking-wider">
              <span className="text-primary">P3D</span> Gen
            </span>
          </Link>

          {/* Desktop Navigation - Stenciled style */}
          <nav className="hidden md:flex items-center gap-0">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'relative px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] transition-all duration-150 border-b-2',
                  location.pathname === item.path
                    ? 'text-primary border-primary'
                    : 'text-text-secondary hover:text-card-foreground border-transparent hover:border-text-secondary'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile menu button - Industrial */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 bg-secondary text-secondary-foreground border-2 border-border hover:bg-primary hover:text-primary-foreground hover:border-foreground transition-all"
            style={{ boxShadow: '2px 2px 0px hsl(20 10% 5%)' }}
          >
            {mobileMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation - Workshop panel */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-t-2 border-border bg-card"
        >
          <nav className="container mx-auto px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'block px-4 py-3 font-bold uppercase tracking-[0.15em] text-xs transition-all border-2',
                  location.pathname === item.path
                    ? 'bg-primary text-primary-foreground border-foreground'
                    : 'text-text-secondary hover:bg-secondary hover:text-secondary-foreground border-transparent hover:border-border'
                )}
                style={location.pathname === item.path ? { boxShadow: '3px 3px 0px hsl(20 10% 5%)' } : {}}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </motion.div>
      )}
    </header>
  );
};

export default Header;