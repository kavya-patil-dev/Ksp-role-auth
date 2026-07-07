/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from "antd";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import API from "../../services/api";

function WorkerManagement({ title = "Worker Management", note }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [form] = Form.useForm();

  const loadWorkers = async () => {
    try {
      setLoading(true);
      const res = await API.get("/workers");
      setWorkers(res.data.workers || []);
    } catch (error) {
      message.error(error.response?.data?.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, []);

  const openModal = (worker = null) => {
    setEditingWorker(worker);
    form.setFieldsValue(
      worker || {
        name: "",
        mobile: "",
        skillType: "",
        status: "ACTIVE",
        notes: "",
      }
    );
    setOpen(true);
  };

  const saveWorker = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingWorker) {
        await API.put(`/workers/${editingWorker.id}`, values);
        message.success("Worker updated successfully");
      } else {
        await API.post("/workers", values);
        message.success("Worker created successfully");
      }
      setOpen(false);
      setEditingWorker(null);
      form.resetFields();
      await loadWorkers();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.response?.data?.message || "Failed to save worker");
    } finally {
      setSaving(false);
    }
  };

  const deleteWorker = async (workerId) => {
    try {
      await API.delete(`/workers/${workerId}`);
      message.success("Worker deleted successfully");
      await loadWorkers();
    } catch (error) {
      message.error(error.response?.data?.message || "Failed to delete worker");
    }
  };

  const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Mobile", dataIndex: "mobile", render: (value) => value || "-" },
    { title: "Skill Type", dataIndex: "skillType", render: (value) => value || "Non-skilled" },
    {
      title: "Status",
      dataIndex: "status",
      render: (status) => {
        const isActive = status === "ACTIVE" || status === "Active";
        return <Tag color={isActive ? "green" : "red"}>{isActive ? "Active" : "Inactive"}</Tag>;
      },
    },
    { title: "Updated By", dataIndex: "updatedBy", render: (value) => value?.name || "-" },
    {
      title: "Actions",
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openModal(record)}>Edit</Button>
          <Popconfirm title="Delete this worker?" onConfirm={() => deleteWorker(record.id)}>
            <Button danger icon={<DeleteOutlined />}>Delete</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Card
        title={title}
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Worker</Button>}
        style={{ borderRadius: 18 }}
      >
        {note && <p style={{ color: "#6b7280", marginTop: 0 }}>{note}</p>}
        <Table rowKey="id" loading={loading} dataSource={workers} columns={columns} pagination={{ pageSize: 8 }} />
      </Card>

      <Modal
        title={editingWorker ? "Edit Worker" : "Add Worker"}
        open={open}
        okText={editingWorker ? "Save Worker" : "Create Worker"}
        confirmLoading={saving}
        onOk={saveWorker}
        onCancel={() => {
          setOpen(false);
          setEditingWorker(null);
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Worker Name" rules={[{ required: true, message: "Worker name is required" }]}>
            <Input placeholder="Enter worker name" />
          </Form.Item>
          <Form.Item name="mobile" label="Mobile Number">
            <Input placeholder="Optional" />
          </Form.Item>
          <Form.Item name="skillType" label="Skill Type">
            <Input placeholder="Non-skilled, helper, loading, etc." />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE">
            <Select options={[{ label: "Active", value: "ACTIVE" }, { label: "Inactive", value: "INACTIVE" }]} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={3} placeholder="Optional notes" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default WorkerManagement;
