/**
 * Catalyst `Link` adapted for react-router-dom.
 *
 * Catalyst originally wraps each anchor in `Headless.DataInteractive` so the
 * child picks up `data-hover` / `data-active` attributes. Since we're not
 * pulling in `@headlessui/react`, we substitute plain hover/focus class
 * variants at the consumer-site and render a regular `<a>` here.
 */
import React, { forwardRef } from "react";
import { Link as RRLink } from "react-router-dom";

export const Link = forwardRef(function Link(
  props: { href: string } & React.ComponentPropsWithoutRef<"a">,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { href, ...rest } = props;
  // Internal routes go through react-router; external stay as plain anchors.
  const isExternal = /^(https?:|mailto:|tel:)/.test(href);
  if (isExternal) {
    return <a {...rest} href={href} ref={ref} />;
  }
  return <RRLink {...rest} to={href} ref={ref} />;
});
