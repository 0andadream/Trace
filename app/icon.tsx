import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#0A0219",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 22,
            height: 10,
            borderBottom: "2.5px dashed #7828E8",
            borderRadius: "0 0 22px 22px",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
