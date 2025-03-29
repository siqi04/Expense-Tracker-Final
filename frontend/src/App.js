import React, { useState, useEffect } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { 
  Container, 
  Table, 
  Button, 
  Form, 
  Modal, 
  Alert,
  Badge,
  Card
} from 'react-bootstrap';

// API base URL - points to your backend
const API_URL = 'http://localhost:5111/api/expenses';