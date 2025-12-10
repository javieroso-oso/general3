import { motion } from 'framer-motion';
import { presets } from '@/types/parametric';
import Layout from '@/components/layout/Layout';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Gallery = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            Design Gallery
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto">
            Explore pre-made designs or use them as starting points for your own creations.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {presets.map((preset, index) => (
            <motion.div
              key={preset.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="group glass-panel overflow-hidden hover:shadow-medium transition-shadow duration-300"
            >
              <div className="aspect-square bg-gradient-to-b from-secondary/50 to-secondary flex items-center justify-center relative overflow-hidden">
                <div
                  className="w-20 h-32 rounded-[40%] bg-muted-foreground/40 group-hover:scale-110 transition-transform duration-300"
                  style={{
                    transform: `scaleX(${preset.params.topRadius / preset.params.baseRadius}) rotate(${preset.params.twistAngle / 4}deg)`,
                    borderRadius: preset.params.wobbleFrequency > 0 ? '30%' : '40%',
                  }}
                />
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{preset.name}</h3>
                  <span className="text-xs font-medium text-text-muted uppercase tracking-wider bg-secondary px-2 py-1 rounded-md">
                    {preset.type}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-text-muted mb-4">
                  <span>Height: {preset.params.height}</span>
                  <span>Twist: {preset.params.twistAngle}°</span>
                </div>
                <Link to={`/?type=${preset.type}&preset=${preset.id}`}>
                  <Button variant="secondary" size="sm" className="w-full gap-2">
                    Open in Generator
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Gallery;
