import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { button, useControls } from "leva";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const corresponding = {
  A: "viseme_PP",
  B: "viseme_kk",
  C: "viseme_I",
  D: "viseme_AA",
  E: "viseme_O",
  F: "viseme_U",
  G: "viseme_FF",
  H: "viseme_TH",
  X: "viseme_PP",
};

export function Avatar(props) {
  const { message, onMessagePlayed, chat, ...primitiveProps } = props;
  const group = useRef();
  const { scene, animations } = useGLTF("/Character_update.glb");
  
  const [lipsync, setLipsync] = useState();
  const { actions } = useAnimations(animations, group);
  const [animation, setAnimation] = useState("Action");
  const [audio, setAudio] = useState(null);
  const [eyeBlinkTime, setEyeBlinkTime] = useState(0);
  const [facialExpression, setFacialExpression] = useState("default");

  // Animation transition effect
  useEffect(() => {
    if (actions[animation]) {
      Object.keys(actions).forEach(key => {
        if (key !== animation && actions[key]) {
          actions[key].fadeOut(0.5);
        }
      });

      actions[animation].reset().fadeIn(0.5).play();
    }
  }, [animation, actions]);

  // Reset morph targets
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.geometry.morphAttributes?.position) {
        child.morphTargetInfluences?.forEach((_, index) => {
          child.morphTargetInfluences[index] = 0;
        });
      }
    });
  }, [scene]);

  // Handle incoming messages
  useEffect(() => {
    if (!message) return;

    setFacialExpression(message.facialExpression || "default");
    setLipsync(message.lipsync);
    setAnimation(message.animation || "Action");

    if (message.audio) {
      const audioClip = new Audio("data:audio/mp3;base64," + message.audio);
      audioClip.play();
      setAudio(audioClip);

      if (onMessagePlayed) {
        audioClip.onended = onMessagePlayed;
      }
    }
  }, [message, onMessagePlayed]);

  // Animation sequence
  useEffect(() => {
    let timeouts = [];
    let loopTimeout;

    const playSequence = () => {
      if (
        actions["Snake_Hiphop_Dance"] &&
        actions["Action"] &&
        actions["Arms_Hiphop_Dance"] &&
        actions["Dance"]
      ) {
        setAnimation("Action");

        timeouts.push(
          setTimeout(() => {
            setAnimation("Arms_Hiphop_Dance");
            const armsDuration = actions["Arms_Hiphop_Dance"].getClip().duration * 1000;

            timeouts.push(
              setTimeout(() => {
                setAnimation("Action");
                const actionDuration = actions["Action"].getClip().duration * 1000;

                timeouts.push(
                  setTimeout(() => {
                    setAnimation("Dance");
                    const danceDuration = actions["Dance"].getClip().duration * 1000;

                    timeouts.push(
                      setTimeout(() => {
                        setAnimation("Action");
                        const action2Duration = actions["Action"].getClip().duration * 1000;

                        timeouts.push(
                          setTimeout(() => {
                            setAnimation("Snake_Hiphop_Dance");
                            const snakeDuration = actions["Snake_Hiphop_Dance"].getClip().duration * 1000;

                            timeouts.push(
                              setTimeout(() => {
                                setAnimation("Action");
                                loopTimeout = setTimeout(playSequence, 3000);
                              }, snakeDuration)
                            );
                          }, action2Duration)
                        );
                      }, danceDuration)
                    );
                  }, actionDuration)
                );
              }, armsDuration)
            );
          }, 2000)
        );
      }
    };

    if (Object.keys(actions).length > 0) {
      playSequence();
    }

    return () => {
      timeouts.forEach((t) => clearTimeout(t));
      if (loopTimeout) clearTimeout(loopTimeout);
    };
  }, [actions]);

  useFrame((state, delta) => {
    setEyeBlinkTime((prev) => prev + delta);

    // Blink logic
    if (eyeBlinkTime > 3 + Math.random() * 2) {
      setEyeBlinkTime(0);

      scene.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
          const eyeIndex = child.morphTargetDictionary["eyes"];
          if (eyeIndex !== undefined) {
            let blinkProgress = 0;
            const blinkDuration = 0.2;

            const blinkAnimation = (time) => {
              blinkProgress += time;
              const progress = Math.min(blinkProgress / blinkDuration, 1);

              const blinkValue = Math.sin(progress * Math.PI);
              child.morphTargetInfluences[eyeIndex] = blinkValue;

              if (progress < 1) {
                requestAnimationFrame(() => blinkAnimation(0.016));
              } else {
                child.morphTargetInfluences[eyeIndex] = 0;
              }
            };

            blinkAnimation(0);
          }
        }
      });
    }

    // Lipsync and facial expression updates
    scene.traverse((child) => {
      if (child.isMesh && child.morphTargetDictionary && child.morphTargetInfluences) {
        const mesh = child;
        
        // Lipsync
        if (lipsync && audio) {
          const appliedMorphTargets = [];
          const currentAudioTime = audio.currentTime;
          
          lipsync.mouthCues.forEach((mouthCue) => {
            if (currentAudioTime >= mouthCue.start && currentAudioTime <= mouthCue.end) {
              const correspondingTarget = corresponding[mouthCue.value];
              const index = mesh.morphTargetDictionary[correspondingTarget];
              if (index !== undefined) {
                mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
                  mesh.morphTargetInfluences[index],
                  1,
                  0.3
                );
                appliedMorphTargets.push(correspondingTarget);
              }
            }
          });

          Object.keys(corresponding).forEach((key) => {
            const target = corresponding[key];
            if (!appliedMorphTargets.includes(target)) {
              const index = mesh.morphTargetDictionary[target];
              if (index !== undefined) {
                mesh.morphTargetInfluences[index] = THREE.MathUtils.lerp(
                  mesh.morphTargetInfluences[index],
                  0,
                  0.1
                );
              }
            }
          });
        }

        // Reset blink targets
        const blinkTargets = ["eyeBlinkLeft", "eyeBlinkRight", "blink", "EyeBlink", "eye_blink"];
        blinkTargets.forEach(target => {
          const index = mesh.morphTargetDictionary[target];
          if (index !== undefined) {
            const eyeIndex = mesh.morphTargetDictionary["eyes"];
            if (index !== eyeIndex) {
              mesh.morphTargetInfluences[index] = 0;
            }
          }
        });
      }
    });
  });



  return <primitive object={scene} {...primitiveProps} ref={group} />;
}

useGLTF.preload("/Character_update.glb");