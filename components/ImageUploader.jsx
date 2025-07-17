"use client";

import React, { useState, useRef, useCallback } from "react";
import { LoadingOutlined, PlusOutlined, CameraOutlined, CloseOutlined } from "@ant-design/icons";
import {
  Form,
  Input,
  Upload,
  Button,
  Row,
  Col,
  Card,
  notification,
  message,
  Modal
} from "antd";

// Utility to convert base64 to File object (from your team)
const base64ToFile = (base64, fileName) => {
  const arr = base64.split(",");
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
  reader.addEventListener("load", () => callback(reader.result));
  reader.readAsDataURL(img);
};

const beforeUpload = (file) => {
  // Allow all image types including camera images
  const isImage = file.type.startsWith("image/");
  if (!isImage) {
    message.error("You can only upload image files!");
    return false;
  }

  // Check file size (2MB limit)
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    notification.error({
      message: "File Too Large",
      description: "Image must be smaller than 2MB!",
      placement: "topRight",
    });
    return false;
  }

  return isImage && isLt2M;
};

// CNIC Camera Component
const CnicCamera = ({ onCapture, onClose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  // CNIC aspect ratio: 85.60 mm × 53.98 mm = 1.586:1
  const CNIC_ASPECT_RATIO = 1.586;

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          console.log('Video loaded, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          setIsStreaming(true);
        };
        
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Unable to access camera. Please check permissions.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsStreaming(false);
    }
  }, []);

  const captureImage = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Wait for video to be ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      console.log('Video not ready, waiting...');
      setTimeout(captureImage, 100);
      return;
    }

    // Calculate CNIC crop dimensions
    const videoWidth = video.videoWidth || video.clientWidth;
    const videoHeight = video.videoHeight || video.clientHeight;
    
    console.log('Video dimensions:', videoWidth, 'x', videoHeight);
    
    if (videoWidth === 0 || videoHeight === 0) {
      console.error('Invalid video dimensions');
      return;
    }
    
    // Calculate crop dimensions to maintain CNIC aspect ratio
    let cropWidth, cropHeight;
    
    if (videoWidth / videoHeight > CNIC_ASPECT_RATIO) {
      // Video is wider than CNIC ratio, crop width
      cropHeight = videoHeight;
      cropWidth = cropHeight * CNIC_ASPECT_RATIO;
    } else {
      // Video is taller than CNIC ratio, crop height
      cropWidth = videoWidth;
      cropHeight = cropWidth / CNIC_ASPECT_RATIO;
    }

    // Center the crop
    const startX = (videoWidth - cropWidth) / 2;
    const startY = (videoHeight - cropHeight) / 2;

    // Set canvas size to CNIC proportions (scale up for better quality)
    const outputWidth = 856; // 85.6mm scaled up
    const outputHeight = 540; // 53.98mm scaled up
    
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    try {
      // Draw the cropped image
      context.drawImage(
        video,
        startX, startY, cropWidth, cropHeight,
        0, 0, outputWidth, outputHeight
      );

      // Convert to base64 for preview
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      console.log('Image captured successfully');
      setCapturedImage(imageDataUrl);
      setShowPreview(true);
    } catch (error) {
      console.error('Error capturing image:', error);
      message.error('Failed to capture image. Please try again.');
    }
  }, [CNIC_ASPECT_RATIO]);

  const confirmCapture = useCallback(() => {
    if (!capturedImage) return;

    // Convert base64 to blob and create file
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      const file = new File([blob], `cnic-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      stopCamera();
    }, 'image/jpeg', 0.9);
  }, [capturedImage, onCapture, stopCamera]);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setShowPreview(false);
  }, []);

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  return (
    <Modal
      title={showPreview ? "Preview Captured CNIC" : "Capture CNIC Image"}
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
          // Preview Mode
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
              <Button
                type="primary"
                size="large"
                onClick={confirmCapture}
                style={{ minWidth: '120px' }}
              >
                ✓ Use This Image
              </Button>
              <Button
                size="large"
                onClick={retakePhoto}
                style={{ minWidth: '120px' }}
              >
                📷 Retake Photo
              </Button>
              <Button
                size="large"
                onClick={handleClose}
                style={{ minWidth: '120px' }}
              >
                ✕ Cancel
              </Button>
            </div>
          </>
        ) : (
          // Camera Mode
          <>
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  maxWidth: '600px',
                  height: 'auto',
                  background: '#000'
                }}
                playsInline
                muted
              />
              
              {/* CNIC Overlay Guide */}
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
              <Button
                size="large"
                onClick={handleClose}
                icon={<CloseOutlined />}
                style={{ minWidth: '100px' }}
              >
                Cancel
              </Button>
            </div>

            <div style={{ marginTop: '10px', color: '#666', fontSize: '12px' }}>
              {isStreaming ? 
                'Position your CNIC within the blue frame and tap "Capture CNIC"' :
                'Starting camera...'
              }
            </div>
          </>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
    </Modal>
  );
};

const App = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [showCamera, setShowCamera] = useState(false);
  const [currentCameraField, setCurrentCameraField] = useState(null);

  // Handle file selection for each upload field
  const handleFileChange = (fieldName) => (info) => {
    if (info.file.status !== "uploading") {
      let file = info.file.originFileObj || info.file;

      // Handle base64 conversion if needed
      if (typeof file === "string" && file.startsWith("data:")) {
        console.log("Converting base64 to File object for", fieldName);
        file = base64ToFile(file, `${fieldName}-${Date.now()}.jpg`);
      }

      // Update file list
      setFileList((prev) => ({
        ...prev,
        [fieldName]: file,
      }));

      // Generate preview
      getBase64(file, (url) => {
        setImagePreviews((prev) => ({
          ...prev,
          [fieldName]: url,
        }));
      });

      console.log(`File selected for ${fieldName}:`, file);
    }
  };

  // Handle camera capture
  const handleCameraCapture = (file) => {
    if (currentCameraField) {
      // Update file list
      setFileList((prev) => ({
        ...prev,
        [currentCameraField]: file,
      }));

      // Generate preview
      getBase64(file, (url) => {
        setImagePreviews((prev) => ({
          ...prev,
          [currentCameraField]: url,
        }));
      });

      console.log(`Camera captured for ${currentCameraField}:`, file);
    }
    setShowCamera(false);
    setCurrentCameraField(null);
  };

  // Open camera for specific field
  const openCamera = (fieldName) => {
    setCurrentCameraField(fieldName);
    setShowCamera(true);
  };

  // Submit form with all data
  const handleSubmit = async (values) => {
    setLoading(true);

    notification.info({
      message: "Submitting...",
      description: "Submitting update...",
      placement: "topRight",
    });

    try {
      const formData = new FormData();

      Object.entries(values).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(key, value);
        }
      });

      Object.entries(fileList).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });

      // Force PATCH only
      const endpoint = "https://boms.qistbazaar.pk/api/order/greenform/update";

      const response = await fetch(endpoint, {
        method: "PATCH",
        body: formData,
        headers: {
          "x-access-token":
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjUsInJvbGUiOjQsImJyYW5jaCI6MzAsImlhdCI6MTc1MjczNjgwMywiZXhwIjoxNzUyNzcyODAzfQ.8qbwNxU30SvCWztPYwIqhr4NZu9cPLTKWaxn_i6T7vA",
        },
      });

      // Enhanced debugging
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      console.log("Response headers:", response.headers);

      if (response.ok) {
        let result;
        try {
          result = await response.json();
          console.log("API Success Response:", result);
        } catch (jsonError) {
          console.warn("Could not parse JSON response:", jsonError);
          result = await response.text();
          console.log("Response as text:", result);
        }

        // This should now show the success notification
        notification.success({
          message: "Success",
          description: "Order updated successfully!",
          placement: "topRight",
          duration: 6, // Show for 6 seconds
        });

        form.resetFields();
        setFileList({});
        setImagePreviews({});
      } else {
        const errorText = await response.text();
        console.error("API Error Response:", errorText);
        console.error("Response status:", response.status);
        
        notification.error({
          message: "Update Failed",
          description: `Failed to update order (Status: ${response.status}). Please check your data and try again.`,
          placement: "topRight",
          duration: 8,
        });
      }
    } catch (error) {
      console.error("Submit error:", error);
      notification.error({
        message: "Error",
        description: `Update failed: ${
          error.message || "Unknown error occurred"
        }`,
        placement: "topRight",
        duration: 8,
      });
    } finally {
      setLoading(false);
    }
  };

  // Custom uploader component with camera option
  const CustomUploader = ({ fieldName, title }) => {
    const uploadButton = (
      <button style={{ border: 0, background: "none" }} type="button">
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
          beforeUpload={() => false} // Prevent auto upload
          onChange={handleFileChange(fieldName)}
          accept="image/*"
        >
          {imagePreviews[fieldName] ? (
            <img
              src={imagePreviews[fieldName]}
              alt={fieldName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            uploadButton
          )}
        </Upload>
        
        {/* Camera Button */}
        <Button
          type="primary"
          size="small"
          style={{ marginTop: '8px', width: '100%' }}
          onClick={() => openCamera(fieldName)}
          icon={<CameraOutlined />}
        >
          Capture CNIC
        </Button>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        {/* Customer Information */}
        <Card title="Customer Information" style={{ marginBottom: "20px" }}>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Order ID" name="orderID">
                <Input placeholder="Enter order ID" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Full Name" name="fullName">
                <Input placeholder="Enter full name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Father Name" name="fatherName">
                <Input placeholder="Enter father name" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Mother Name" name="motherName">
                <Input placeholder="Enter mother name" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="CNIC" name="cnic">
                <Input placeholder="Enter CNIC number" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Phone Number" name="phoneNo">
                <Input placeholder="Enter phone number" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Date of Issue" name="dateOfIssue">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Date of Expiry" name="dateOfExpiry">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Date of Birth" name="dateOfBirth">
                <Input placeholder="YYYY-MM-DD" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item label="Place of Birth" name="PlaceOfBirth">
                <Input placeholder="Enter place of birth" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Source of Earning" name="sourceOfEarning">
                <Input placeholder="Enter source of earning" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Income" name="income">
                <Input placeholder="Enter income amount" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={24}>
              <Form.Item label="Address" name="address">
                <Input.TextArea rows={2} placeholder="Enter complete address" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Document Uploads */}
        <Card title="Document Uploads" style={{ marginBottom: "20px" }}>
          <Row gutter={16}>
            <Col span={6}>
              <div style={{ textAlign: "center" }}>
                <CustomUploader fieldName="acknowledgement" title="Upload CNIC" />
              </div>
            </Col>
          </Row>
        </Card>

        {/* Submit Button */}
        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            size="large"
            style={{ width: "200px" }}
          >
            {loading ? "Processing..." : "Submit/Update Order"}
          </Button>
        </Form.Item>
      </Form>

      {/* Camera Modal */}
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