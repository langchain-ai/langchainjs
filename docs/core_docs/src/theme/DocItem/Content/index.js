import React from "react";
import Content from "@theme-original/DocItem/Content";
import Feedback from "../../Feedback";

export default function ContentWrapper(props) {
  return (
    <>
      {/* eslint-disable react/jsx-props-no-spreading */}
      <Content {...props} />
      <Feedback />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <p style={{ fontSize: 13.3333 }}><i>Last updated on <strong>Jan 1, 2024</strong></i></p>
      </div>
    </>
  );
}
