import React from 'react';
import OriginalMDXComponents from '@theme-original/MDXComponents';
import Feedback from './Feedback'; // Adjust the import path as needed

export default {
  ...OriginalMDXComponents,
  // Add your component here. For example, wrap content with your component:
  wrapper: ({children}) => (
    <>
      <div>{children}</div>
      <Feedback />
    </>
  ),
};
