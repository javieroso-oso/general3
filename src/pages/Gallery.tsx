import { motion } from 'framer-motion';
import { presets } from '@/types/parametric';
import Layout from '@/components/layout/Layout';
import { Link } from 'react-router-dom';
import { ArrowRight, Loader2, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useGallery } from '@/hooks/useGallery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Gallery = () => {
  const { designs, loading } = useGallery();

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
            Explore pre-made designs and community creations, or use them as starting points.
          </p>
        </motion.div>

        <Tabs defaultValue="community" className="w-full">
          <TabsList className="mb-8 mx-auto flex w-fit">
            <TabsTrigger value="community">Community Designs</TabsTrigger>
            <TabsTrigger value="presets">Built-in Presets</TabsTrigger>
          </TabsList>

          <TabsContent value="community">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : designs.length === 0 ? (
              <div className="text-center py-20">
                <ImageOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No community designs yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Be the first to share your creation!
                </p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {designs.map((design, index) => (
                  <motion.div
                    key={design.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="group glass-panel overflow-hidden hover:shadow-medium transition-shadow duration-300"
                  >
                    <div className="aspect-square bg-gradient-to-b from-secondary/50 to-secondary flex items-center justify-center relative overflow-hidden">
                      {design.thumbnail_url ? (
                        <img
                          src={design.thumbnail_url}
                          alt={design.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div
                          className="w-20 h-32 rounded-[40%] bg-muted-foreground/40 group-hover:scale-110 transition-transform duration-300"
                          style={{
                            transform: `scaleX(${design.params.topRadius / design.params.baseRadius}) rotate(${design.params.twistAngle / 4}deg)`,
                            borderRadius: design.params.wobbleFrequency > 0 ? '30%' : '40%',
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300" />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-foreground truncate">{design.name}</h3>
                        <span className="text-xs font-medium text-text-muted uppercase tracking-wider bg-secondary px-2 py-1 rounded-md flex-shrink-0 ml-2">
                          {design.object_type}
                        </span>
                      </div>
                      {design.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {design.description}
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-2 text-xs text-text-muted mb-4">
                        <span>Height: {design.params.height}</span>
                        <span>Twist: {design.params.twistAngle}°</span>
                      </div>
                      <Link to={`/?type=${design.object_type}&params=${encodeURIComponent(JSON.stringify(design.params))}`}>
                        <Button variant="secondary" size="sm" className="w-full gap-2">
                          Open in Generator
                          <ArrowRight className="w-4 h-4" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="presets">
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
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-text-muted mb-4">
                      <span>Height: {preset.params.height}</span>
                      <span>Twist: {preset.params.twistAngle}°</span>
                    </div>
                    <Link to={`/?preset=${preset.id}`}>
                      <Button variant="secondary" size="sm" className="w-full gap-2">
                        Open in Generator
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Gallery;
