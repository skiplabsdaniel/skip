import * as eng from "../engine/index.js";

const button: eng.Renderable = (_scope) => {
  return eng.flex({
    children: [
      eng.button({
        "on-fire": (count) => {
          console.log(`Click: ${count}`);
        },
        mode: eng.ButtonMode.Basic,
        kind: eng.ButtonKind.Regular,
        text: "My button",
        icon: eng.icons.Heart,
      }),
    ],
    vertical: true,
    "main-alignment": eng.Alignment.Center,
    "cross-alignment": eng.FlCrossAlign.Center,
  });
};

await eng.launch(document.title, button);
