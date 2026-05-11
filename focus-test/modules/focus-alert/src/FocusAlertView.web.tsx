import * as React from 'react';

import { FocusAlertViewProps } from './FocusAlert.types';

export default function FocusAlertView(props: FocusAlertViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
