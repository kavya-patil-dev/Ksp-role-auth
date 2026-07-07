import { Input } from "antd";

function SmartTextArea({ value = "", onChange, rows = 4, placeholder, ...props }) {
  return (
    <Input.TextArea
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      {...props}
    />
  );
}

export default SmartTextArea;
