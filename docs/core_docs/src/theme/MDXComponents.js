import React from 'react';
import Feedback from './Feedback'; // Adjust the import path as needed
import OriginalMDXComponents from '@theme-original/MDXComponents';

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
