'use client';

import React, { useState, useRef, useCallback } from 'react';
import { PlusOutlined, CameraOutlined, CloseOutlined } from '@ant-design/icons';
import { Form, Input, Upload, Button, Row, Col, Card, notification, message, Modal } from 'antd';

// Utilities
const base64ToFile = (base64, fileName) => {
  const arr = base64.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], fileName, { type: mime });
};

const getBase64 = (img, callback) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result));
  reader.readAsDataURL(img);
};

const beforeUpload = file => {
  if (!file.type.startsWith('image/')) {
    message.error('You can only upload image files!');
    return false;
  }
  if (file.size / 1024 / 1024 >= 2) {
    notification.error({
      message: 'File Too Large',
      description: 'Image must be smaller than 2MB!',
      placement: 'topRight'
    });
    return false;
  }
  return true;
};

// CNIC Camera Component
const CnicCamera = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const CNIC_ASPECT_RATIO = 1.586;

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsStreaming(false);

      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920, min: 640 }, height: { ideal: 1080, min: 480 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            .play()
            .then(() => setIsStreaming(true))
            .catch(() => setError('Unable to start camera.'));
        };
        videoRef.current.onerror = () => setError('Camera error occurred.');
      }
    } catch (err) {
      setError('Unable to access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const captureImage = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const context = canvas.getContext('2d');
    const { videoWidth = video.clientWidth, videoHeight = video.clientHeight } = video;
    const { clientWidth: displayWidth, clientHeight: displayHeight } = video;

    if (!videoWidth || !videoHeight) return;

    // Calculate overlay dimensions and position
    const overlayWidth = displayWidth * 0.8;
    const overlayHeight = overlayWidth / CNIC_ASPECT_RATIO;
    const overlayX = (displayWidth - overlayWidth) / 2;
    const overlayY = (displayHeight - overlayHeight) / 2;

    // Scale to video coordinates
    const scaleX = videoWidth / displayWidth;
    const scaleY = videoHeight / displayHeight;
    const cropX = overlayX * scaleX;
    const cropY = overlayY * scaleY;
    const cropWidth = overlayWidth * scaleX;
    const cropHeight = overlayHeight * scaleY;

    // Set canvas and draw
    canvas.width = 856;
    canvas.height = 540;

    try {
      context.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, 856, 540);
      setCapturedImage(canvas.toDataURL('image/jpeg', 0.9));
      setShowPreview(true);
    } catch (error) {
      message.error('Failed to capture image.');
    }
  }, [CNIC_ASPECT_RATIO]);

  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;
    canvasRef.current.toBlob(
      blob => {
        onCapture(new File([blob], `cnic-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        stopCamera();
      },
      'image/jpeg',
      0.9
    );
  }, [capturedImage, onCapture, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setShowPreview(false);
    setTimeout(startCamera, 100);
  }, [startCamera]);

  React.useEffect(() => {
    startCamera();
    return stopCamera;
  }, [startCamera, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const renderPreview = () => (
    <>
      <div style={{ marginBottom: '20px' }}>
        <img
          src={capturedImage}
          alt="Captured CNIC"
          style={{
            maxWidth: '100%',
            maxHeight: '400px',
            border: '2px solid #1890ff',
            borderRadius: '8px',
            objectFit: 'contain'
          }}
        />
      </div>
      <div style={{ marginBottom: '10px', color: '#666' }}>
        <strong>Is this image clear and readable?</strong>
        <br />
        Make sure all text and details are visible
      </div>
      <div style={{ gap: '10px', display: 'flex', justifyContent: 'center' }}>
        <Button type="primary" size="large" onClick={confirmCapture} style={{ minWidth: '120px' }}>
          ✓ Use This Image
        </Button>
        <Button size="large" onClick={retakePhoto} style={{ minWidth: '120px' }}>
          📷 Retake Photo
        </Button>
        <Button size="large" onClick={handleClose} style={{ minWidth: '120px' }}>
          ✕ Cancel
        </Button>
      </div>
    </>
  );

  const renderCamera = () => (
    <>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <video
          ref={videoRef}
          style={{ width: '100%', maxWidth: '600px', height: 'auto', background: '#000' }}
          playsInline
          muted
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid #1890ff',
            borderRadius: '8px',
            background: 'rgba(24, 144, 255, 0.1)',
            width: '80%',
            aspectRatio: `${CNIC_ASPECT_RATIO}`,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1890ff',
            fontSize: '14px',
            fontWeight: 'bold',
            textAlign: 'center',
            textShadow: '0 0 4px rgba(0,0,0,0.5)'
          }}
        >
          Place CNIC within this frame
        </div>
      </div>
      <div style={{ marginTop: '20px', gap: '10px', display: 'flex', justifyContent: 'center' }}>
        <Button
          type="primary"
          size="large"
          onClick={captureImage}
          disabled={!isStreaming}
          icon={<CameraOutlined />}
          style={{ minWidth: '140px' }}
        >
          {isStreaming ? 'Capture CNIC' : 'Loading...'}
        </Button>
        <Button size="large" onClick={handleClose} icon={<CloseOutlined />} style={{ minWidth: '100px' }}>
          Cancel
        </Button>
      </div>
      <div style={{ marginTop: '10px', color: '#666', fontSize: '12px' }}>
        {isStreaming ? 'Position your CNIC within the blue frame and tap "Capture CNIC"' : 'Starting camera...'}
      </div>
    </>
  );

  return (
    <Modal
      title={showPreview ? 'Preview Captured CNIC' : 'Capture CNIC Image'}
      open={true}
      onCancel={handleClose}
      width={800}
      footer={null}
      maskClosable={false}
    >
      <div style={{ textAlign: 'center' }}>
        {error ? (
          <div style={{ color: 'red', padding: '20px' }}>
            {error}
            <br />
            <Button onClick={startCamera} style={{ marginTop: '10px' }}>
              Try Again
            </Button>
          </div>
        ) : showPreview ? (
          renderPreview()
        ) : (
          renderCamera()
        )}
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </Modal>
  );
};

// Custom Uploader Component
const CustomUploader = ({ fieldName, title, imagePreviews, onFileChange, onCameraOpen }) => {
  const uploadButton = (
    <button style={{ border: 0, background: 'none' }} type="button">
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>{title}</div>
    </button>
  );

  return (
    <div>
      <Upload
        name={fieldName}
        listType="picture-card"
        className="avatar-uploader"
        showUploadList={false}
        beforeUpload={() => false}
        onChange={onFileChange(fieldName)}
        accept="image/*"
      >
        {imagePreviews[fieldName] ? (
          <img
            src={imagePreviews[fieldName]}
            alt={fieldName}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          uploadButton
        )}
      </Upload>
      <Button
        type="primary"
        size="small"
        style={{ marginTop: '8px', width: '100%' }}
        onClick={() => onCameraOpen(fieldName)}
        icon={<CameraOutlined />}
      >
        Capture CNIC
      </Button>
    </div>
  );
};

// Form Fields Configuration
const FORM_FIELDS = [
  [
    { label: 'Order ID', name: 'orderID', placeholder: 'Enter order ID' },
    { label: 'Full Name', name: 'fullName', placeholder: 'Enter full name' },
    { label: 'Father Name', name: 'fatherName', placeholder: 'Enter father name' }
  ],
  [
    { label: 'Mother Name', name: 'motherName', placeholder: 'Enter mother name' },
    { label: 'CNIC', name: 'cnic', placeholder: 'Enter CNIC number' },
    { label: 'Phone Number', name: 'phoneNo', placeholder: 'Enter phone number' }
  ],
  [
    { label: 'Date of Issue', name: 'dateOfIssue', placeholder: 'YYYY-MM-DD' },
    { label: 'Date of Expiry', name: 'dateOfExpiry', placeholder: 'YYYY-MM-DD' },
    { label: 'Date of Birth', name: 'dateOfBirth', placeholder: 'YYYY-MM-DD' }
  ],
  [
    { label: 'Place of Birth', name: 'PlaceOfBirth', placeholder: 'Enter place of birth' },
    { label: 'Source of Earning', name: 'sourceOfEarning', placeholder: 'Enter source of earning' },
    { label: 'Income', name: 'income', placeholder: 'Enter income amount' }
  ]
];

// Customer Information Component
const CustomerInformation = () => (
  <Card title="Customer Information" style={{ marginBottom: '20px' }}>
    {FORM_FIELDS.map((row, index) => (
      <Row gutter={16} key={index}>
        {row.map(field => (
          <Col span={8} key={field.name}>
            <Form.Item label={field.label} name={field.name}>
              <Input placeholder={field.placeholder} />
            </Form.Item>
          </Col>
        ))}
      </Row>
    ))}
    <Row gutter={16}>
      <Col span={24}>
        <Form.Item label="Address" name="address">
          <Input.TextArea rows={2} placeholder="Enter complete address" />
        </Form.Item>
      </Col>
    </Row>
  </Card>
);

// Main App Component
const App = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [currentCameraField, setCurrentCameraField] = useState(null);

  const handleFileChange = fieldName => info => {
    if (info.file.status === 'uploading') return;

    if (!validateFile(info.file.originFileObj || info.file)) return;

    let file = info.file.originFileObj || info.file;
    if (typeof file === 'string' && file.startsWith('data:')) {
      file = base64ToFile(file, `${fieldName}-${Date.now()}.jpg`);
    }

    setFileList(prev => ({ ...prev, [fieldName]: file }));
    getBase64(file, url => setImagePreviews(prev => ({ ...prev, [fieldName]: url })));
  };

  const handleCameraCapture = file => {
    if (currentCameraField) {
      setFileList(prev => ({ ...prev, [currentCameraField]: file }));
      getBase64(file, url => setImagePreviews(prev => ({ ...prev, [currentCameraField]: url })));
    }
    setShowCamera(false);
    setCurrentCameraField(null);
  };

  const openCamera = fieldName => {
    setCurrentCameraField(fieldName);
    setShowCamera(true);
  };

  const handleSubmit = async values => {
    setLoading(true);
    notification.info({ message: 'Submitting...', description: 'Submitting update...', placement: 'topRight' });

    try {
      const formData = new FormData();
      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') formData.append(key, value);
      });
      Object.entries(fileList).forEach(([key, file]) => {
        if (file) formData.append(key, file);
      });

      const response = await fetch('https://boms.qistbazaar.pk/api/order/greenform/update', {
        method: 'PATCH',
        body: formData,
        headers: {
          'x-access-token':
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInJvbGUiOjQsImJyYW5jaCI6MzAsImlhdCI6MTc1MjgyNTQ5MiwiZXhwIjoxNzUyODYxNDkyfQ.rx8nYSSrlurKb_S2Ok6IvhBE7kzsVNUVVDJtod67lRw'
        }
      });

      if (response.ok) {
        notification.success({
          message: 'Success',
          description: 'Order updated successfully!',
          placement: 'topRight',
          duration: 6
        });
        form.resetFields();
        setFileList({});
        setImagePreviews({});
      } else {
        notification.error({
          message: 'Update Failed',
          description: `Failed to update order (Status: ${response.status}).`,
          placement: 'topRight',
          duration: 8
        });
      }
    } catch (error) {
      notification.error({
        message: 'Error',
        description: `Update failed: ${error.message || 'Unknown error'}`,
        placement: 'topRight',
        duration: 8
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <CustomerInformation />

        <Card title="Document Uploads" style={{ marginBottom: '20px' }}>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ textAlign: 'center' }}>
                <CustomUploader
                  fieldName="acknowledgement"
                  title="Upload CNIC"
                  imagePreviews={imagePreviews}
                  onFileChange={handleFileChange}
                  onCameraOpen={openCamera}
                />
              </div>
            </Col>
          </Row>
        </Card>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} size="large" style={{ width: '200px' }}>
            {loading ? 'Processing...' : 'Submit/Update Order'}
          </Button>
        </Form.Item>
      </Form>

      {showCamera && (
        <CnicCamera
          onCapture={handleCameraCapture}
          onClose={() => {
            setShowCamera(false);
            setCurrentCameraField(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
