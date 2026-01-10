import { Soul, load } from "@opensouls/engine";

const soul: Soul = {
  name: "Tanaki",
  staticMemories: {
    core: load("./staticMemories/core.md")
  }
}

export default soul
