import { Environment } from "@react-three/drei";
import { Avatar } from "./Avatar";
import { Scene } from "./Scene";


export const Experience = (props) => {
  const {
    avatarPosition = [0, 0, 0],
    avatarRotation = [0, 0, 0],
    avatarScale = 0.4,
    scenePosition,
    sceneRotation,
    sceneScale,
    message,
    onMessagePlayed,
    chat,
  } = props;

  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.5} />
      
      <group position={[0, -1.3, 0]}>
        <Avatar 
          position={avatarPosition} 
          rotation={avatarRotation} 
          scale={avatarScale}
          message={message}
          onMessagePlayed={onMessagePlayed}
          chat={chat}
        />
        <Scene
          position={scenePosition}
          rotation={sceneRotation}
          scale={sceneScale}
        />
      </group>
    </>
  );
};