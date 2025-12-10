import { useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '@/components/layout/Layout';
import Scene3D from '@/components/3d/Scene3D';
import ParameterControls from '@/components/controls/ParameterControls';
import PresetGallery from '@/components/controls/PresetGallery';
import ObjectTypeTabs from '@/components/controls/ObjectTypeTabs';
import { ParametricParams, ObjectType, defaultParams } from '@/types/parametric';

const Index = () => {
  const [objectType, setObjectType] = useState<ObjectType>('vase');
  const [params, setParams] = useState<ParametricParams>(defaultParams.vase);

  const handleTypeChange = (type: ObjectType) => {
    setObjectType(type);
    setParams(defaultParams[type]);
  };

  return (
    <Layout showFooter={false}>
      <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
        {/* Left Panel - Controls */}
        <motion.aside
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full lg:w-96 xl:w-[420px] border-r border-border bg-card overflow-y-auto"
        >
          <div className="p-6 space-y-6">
            {/* Object Type Tabs */}
            <div className="flex justify-center">
              <ObjectTypeTabs
                activeType={objectType}
                onTypeChange={handleTypeChange}
              />
            </div>

            {/* Parameter Controls */}
            <div className="control-card">
              <h2 className="text-lg font-semibold mb-4 text-foreground">Parameters</h2>
              <ParameterControls
                params={params}
                type={objectType}
                onParamsChange={setParams}
              />
            </div>

            {/* Preset Gallery */}
            <div className="control-card">
              <PresetGallery
                type={objectType}
                currentParams={params}
                onSelect={setParams}
              />
            </div>
          </div>
        </motion.aside>

        {/* Right Panel - 3D Viewer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex-1 p-4 lg:p-8 bg-background"
        >
          <div className="h-full glass-panel-elevated overflow-hidden">
            <Scene3D params={params} type={objectType} />
          </div>
        </motion.div>
      </div>
    </Layout>
  );
};

export default Index;
