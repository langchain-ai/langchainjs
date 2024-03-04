import React from 'react';
import Content from '@theme-original/DocItem/Content';
import Feedback from '../../Feedback';

export default function ContentWrapper(props) {
  return (
    <>
      <Content {...props} />
      <Feedback />
    </>
  );
}
