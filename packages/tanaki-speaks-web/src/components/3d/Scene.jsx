import React, { useEffect, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'

export function Scene(props) {
  const group = useRef()
  const { nodes, materials, animations } = useGLTF('/scene-transformed.glb')
  const { actions, names } = useAnimations(animations, group)

  useEffect(() => {
    if (actions && names.length > 0) {
      actions[names[0]]?.reset().fadeIn(0.5).play()
    }
    return () => {
      if (actions && names.length > 0) {
        actions[names[0]]?.fadeOut(0.5)
      }
    }
  }, [actions, names])

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="Scene">
        <group name="RootNode" position={[0, -3.205, -2.904]} scale={0.01}>
          <group name="BillboardsB2" position={[499.175, 575.628, -494.517]} rotation={[0, -0.286, 0]} scale={100}>
            <mesh name="BillboardsB2_BillboardsB2_0" geometry={nodes.BillboardsB2_BillboardsB2_0.geometry} material={materials['Billboards.B2']} />
          </group>
          <group name="BillboardsD4" position={[-623.385, 1377.972, -1991.866]} rotation={[-Math.PI / 2, 0, 0.009]} scale={[250, 250, 78.5]}>
            <mesh name="BillboardsD4_BillboardsD4_0" geometry={nodes.BillboardsD4_BillboardsD4_0.geometry} material={materials['Billboards.D4']} />
          </group>
          <group name="Fogfar" position={[359.934, 0, -1561.036]} scale={[3021.152, 3785.889, 3021.152]}>
            <mesh name="Fogfar_Fog_0" geometry={nodes.Fogfar_Fog_0.geometry} material={materials['material.001']} />
          </group>
          <group name="Fognear" position={[-372.909, 0, -888.535]} scale={[2732.498, 2311.023, 2732.498]}>
            <mesh name="Fognear_Fog_0" geometry={nodes.Fognear_Fog_0.geometry} material={materials['material.001']} />
          </group>
        </group>
        <mesh name="BillboardB6_BillboardsB6_0" geometry={nodes.BillboardB6_BillboardsB6_0.geometry} material={materials['Billboards.B6']} position={[-3.084, 0.022, -6.494]} rotation={[-Math.PI / 2, 0, 0]} scale={0.751} />
        <mesh name="BillboardB6001_BillboardsB22_0" geometry={nodes.BillboardB6001_BillboardsB22_0.geometry} material={materials['Billboards.B2.2']} position={[3.646, 0.742, -7.398]} rotation={[-Math.PI / 2, 0, 0]} scale={0.639} />
        <mesh name="BillboardC4_BillboardC4_0" geometry={nodes.BillboardC4_BillboardC4_0.geometry} material={materials['Billboard.C4']} position={[-5.797, 7.358, -12.484]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.267, 1.313, 1.05]} />
        <mesh name="BillboardC5_BillboardsC5_0" geometry={nodes.BillboardC5_BillboardsC5_0.geometry} material={materials['Billboards.C5']} position={[-0.089, -3.205, -2.904]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.124, 1, 1.012]} />
        <mesh name="BillboardC502_BillboardC52_0" geometry={nodes.BillboardC502_BillboardC52_0.geometry} material={materials['Billboard.C5.2']} position={[0, -3.205, -2.904]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh name="BillboardsC7_BillboardsC7_0" geometry={nodes.BillboardsC7_BillboardsC7_0.geometry} material={materials['Billboards.C7']} position={[0, -3.205, -2.904]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh name="BillboardsD7_BillboardsD7_0" geometry={nodes.BillboardsD7_BillboardsD7_0.geometry} material={materials['Billboards.D7']} position={[5.935, 11.39, -21.687]} scale={1.294} />
        <mesh name="BillboardsD9_BillboardsD9_0" geometry={nodes.BillboardsD9_BillboardsD9_0.geometry} material={materials['Billboards.D9']} position={[17.853, 12.352, -22.177]} scale={[1.8, 0.6, 1.89]} />
        <mesh name="Buildings_Building_0" geometry={nodes.Buildings_Building_0.geometry} material={materials.Building} position={[17.862, -3.205, -24.022]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.865, 1.776, 1]} />
        <mesh name="Buildingsdark_Building_dark_0" geometry={nodes.Buildingsdark_Building_dark_0.geometry} material={materials.Building_dark} position={[5.689, -3.205, -7.86]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.783, 0.912, 1]} />
        <mesh name="Catenary_Catenary003_0" geometry={nodes.Catenary_Catenary003_0.geometry} material={materials['Catenary.003']} position={[-2.604, 4.874, -13.706]} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh name="Emissivecyan_Emissivecyan_0" geometry={nodes.Emissivecyan_Emissivecyan_0.geometry} material={materials['Emissive.cyan']} position={[0.165, -3.205, -7.86]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.412, 1.803, 1]} />
        <mesh name="Emissiveviolet_Emissiveviolet_0" geometry={nodes.Emissiveviolet_Emissiveviolet_0.geometry} material={materials['Emissive.violet']} position={[0.165, -3.205, -7.86]} rotation={[-Math.PI / 2, 0, 0]} scale={[2.412, 1.803, 1]} />
        <mesh name="Emissiveyellow_Emissiveyellow_0" geometry={nodes.Emissiveyellow_Emissiveyellow_0.geometry} material={materials['Emissive.yellow']} position={[-3.437, 1.315, -6.603]} rotation={[-Math.PI / 2, 0, 1.207]} scale={[0.941, 1.783, 1]} />
        <mesh name="Platform_Platform_0" geometry={nodes.Platform_Platform_0.geometry} material={materials.Platform} position={[0, -3.205, -2.029]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.233, 1.261, 1]} />
      </group>
    </group>
  )
}

useGLTF.preload('/scene-transformed.glb')