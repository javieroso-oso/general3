import { motion } from 'framer-motion';
import { Box, Layers, Cpu, Zap } from 'lucide-react';
import Layout from '@/components/layout/Layout';

const features = [
  {
    icon: Box,
    title: 'Parametric Design',
    description: 'Create complex 3D shapes by adjusting simple parameters. Each change updates the geometry in real-time.',
  },
  {
    icon: Layers,
    title: 'Versatile Features',
    description: 'Add wireframe shade frames, light perforation patterns, cord holes, socket mounts, and ceramic molds — all as optional toggles on any shape.',
  },
  {
    icon: Cpu,
    title: 'Real-time Rendering',
    description: 'WebGL-powered 3D preview updates instantly as you adjust parameters, with smooth 60fps performance.',
  },
  {
    icon: Zap,
    title: 'Export & Share',
    description: 'Download your creations as STL or OBJ files for 3D printing, or share designs with a simple link.',
  },
];

const About = () => {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
            About Parametric Design
          </h1>
          <p className="text-lg text-text-secondary max-w-2xl mx-auto leading-relaxed">
            Parametric 3D modeling is a design approach where objects are defined by a set 
            of parameters rather than fixed shapes. Change one parameter, and the entire 
            form adapts intelligently.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="glass-panel p-8 mb-12"
        >
          <h2 className="text-2xl font-semibold mb-4 text-foreground">How It Works</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Traditional 3D modeling requires manually placing every vertex and face. 
            Parametric design takes a different approach: you define relationships and rules, 
            then adjust parameters to explore infinite variations.
          </p>
          <p className="text-text-secondary leading-relaxed">
            Our generator uses mathematical functions to create smooth, organic surfaces. 
            Parameters like height, radius, and twist angle are fed into these functions 
            to produce unique geometries that would be difficult to model by hand.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.1 }}
              className="control-card"
            >
              <div className="w-12 h-12 rounded-xl bg-accent-blue-light flex items-center justify-center mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default About;
