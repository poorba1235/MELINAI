import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment } from "@react-three/drei";
import { Suspense } from "react";
import { Experience } from "./Experience";

export function Tanaki3DExperience(props) {


  return (
<Canvas camera={{ position: [0, 0, 2], fov: 45 }}>
<Experience />
<OrbitControls
  maxPolarAngle={Math.PI / 2}
  minDistance={1}
  maxDistance={2}
  minAzimuthAngle={-Math.PI / 4}
  maxAzimuthAngle={Math.PI / 4}
  enableDamping={true}
  dampingFactor={0.05}
  rotateSpeed={0.8}
  smoothTime={0.3}
 />

      </Canvas>
  );
}